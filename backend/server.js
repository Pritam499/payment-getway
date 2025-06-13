const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require("crypto");

dotenv.config();

// Middlewares
app.use(cors({
    origin: "http://localhost:3000", // Frontend URL
    credentials: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Razorpay Webhook Endpoint (raw parser BEFORE bodyParser.json)
// Place this before express.json()
app.post('/razorpay/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const receivedSignature = req.headers['x-razorpay-signature'];

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

    if (receivedSignature === expectedSignature) {
        console.log("✅ Webhook verified");

        const event = JSON.parse(req.body);

        console.log("📦 Webhook Event Type:", event.event);

        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            console.log("💰 Payment Captured:", payment);

            const orders = readData();
            const updatedOrders = orders.map(order =>
                order.order_id === payment.order_id
                    ? { ...order, status: 'captured', payment_id: payment.id }
                    : order
            );
            writeData(updatedOrders);

        } else if (event.event === 'payment.failed') {
            const payment = event.payload.payment.entity;
            console.log("❌ Payment Failed:", payment.id);
            console.log("Reason:", payment.error_description || 'No description');

            const orders = readData();
            const updatedOrders = orders.map(order =>
                order.order_id === payment.order_id
                    ? { ...order, status: 'failed', payment_id: payment.id, reason: payment.error_description }
                    : order
            );
            writeData(updatedOrders);
        } else if (event.event === 'refund.created') {
            const refund = event.payload.refund.entity;
            console.log("💸 Refund Initiated:", refund.id);
        
            const orders = readData();
            const updatedOrders = orders.map(order =>
                order.payment_id === refund.payment_id
                    ? { ...order, status: 'refund_initiated', refund_id: refund.id }
                    : order
            );
            writeData(updatedOrders);
        
        } else if (event.event === 'refund.processed') {
            const refund = event.payload.refund.entity;
            console.log("✅ Refund Processed:", refund.id);
        
            const orders = readData();
            const updatedOrders = orders.map(order =>
                order.payment_id === refund.payment_id
                    ? { ...order, status: 'refunded', refund_id: refund.id }
                    : order
            );
            writeData(updatedOrders);
        
        } else if (event.event === 'refund.failed') {
            const refund = event.payload.refund.entity;
            console.log("❌ Refund Failed:", refund.id, refund.status);
        
            const orders = readData();
            const updatedOrders = orders.map(order =>
                order.payment_id === refund.payment_id
                    ? { ...order, status: 'refund_failed', refund_id: refund.id }
                    : order
            );
            writeData(updatedOrders);

        res.status(200).json({ status: 'ok' });
    } else {
        console.warn("❌ Webhook signature mismatch");
        res.status(400).send("Invalid signature");
    }
}
});


// ✅ Now apply body parsers for other routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Razorpay credentials
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Read/write helpers for orders.json
const readData = () => {
    if (fs.existsSync('orders.json')) {
        const data = fs.readFileSync('orders.json');
        return JSON.parse(data);
    }
    return [];
};

const writeData = (data) => {
    fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));
};

// Initialize orders.json if it doesn't exist
if (!fs.existsSync('orders.json')) {
    writeData([]);
}

// Create Razorpay Order
app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt, notes } = req.body;

        const options = {
            amount,
            currency,
            receipt,
            notes
        };

        const order = await razorpay.orders.create(options);
        console.log(order)

        const orders = readData();
        orders.push({
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
            status: 'created'
        });
        writeData(orders);

        res.json(order);
    } catch (err) {
        console.error('Create Order Error:', err);
        res.status(500).json('Create Order Error');
    }
});

// Verify Payment Signature
app.post('/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    console.log("Payment Verification is in process", razorpay_order_id, razorpay_payment_id, razorpay_signature )
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature === razorpay_signature) {
        res.json({ success: true, message: "Payment verified successfully." });
    } else {
        res.status(400).json({ success: false, message: "Payment verification failed." });
    }
});


// Refund Endpoint
app.post('/refund', async (req, res) => {
    const { payment_id, amount } = req.body; // amount is optional (in paise)

    if (!payment_id) {
        return res.status(400).json({ success: false, message: 'Payment ID is required for refund.' });
    }

    try {
        const refund = await razorpay.payments.refund(payment_id, {
            amount, // Optional: if omitted, full refund is issued
        });

        // ✅ Optionally update the local orders.json
        const orders = readData();
        const updatedOrders = orders.map(order =>
            order.payment_id === payment_id
                ? { ...order, status: 'refunded', refund_id: refund.id, refund_amount: refund.amount }
                : order
        );
        writeData(updatedOrders);

        res.json({ success: true, message: 'Refund initiated successfully', refund });
    } catch (err) {
        console.error('Refund Error:', err);
        res.status(500).json({ success: false, message: 'Refund failed', error: err.message });
    }
});


// Payment Success (manual fallback)
app.post('/payment-success', (req, res) => {
    res.status(200).json({ success: true, message: "Payment successful" });
});

// Payment Failure
app.post('/payment-failed', (req, res) => {
    res.send("Payment failed! Please try again.");
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});



// const express = require('express');
// const Razorpay = require('razorpay');
// const bodyParser = require('body-parser');
// const path = require('path');
// const fs = require('fs');
// const app = express();
// const port = process.env.PORT || 5000;
// const cors = require('cors');
// const dotenv = require('dotenv');
// dotenv.config();
// const crypto = require("crypto");

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// // API to serve static assets (React will handle this)
// app.use(express.static(path.join(__dirname, 'public')));

// // Razorpay credentials
// const razorpay = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET
// });

// // Read and write orders to JSON file
// const readData = () => {
//     if (fs.existsSync('orders.json')) {
//         const data = fs.readFileSync('orders.json');
//         return JSON.parse(data);
//     }
//     return [];
// };

// const writeData = (data) => {
//     fs.writeFileSync('orders.json', JSON.stringify(data, null, 2));
// };

// // Initialize orders.json if it doesn't exist
// if (!fs.existsSync('orders.json')) {
//     writeData([]);
// }

// app.use(cors({
//     origin: "http://localhost:3000", // Frontend URL
//     credentials: true // Allow cookies & authentication headers
// }));


// app.post('/create-order', async (req, res) => {
//     try {
//         const { amount , currency = 'INR', receipt, notes } = req.body;
// const options = {
//     amount: amount , // Convert to paise
//     currency,
//     receipt,
//     notes
// };

//         const order = await razorpay.orders.create(options);

//         // Add the order to JSON file

//         console.log(order)

//         const orders = readData();
//         orders.push({
//             order_id: order.id,
//             amount: order.amount,
//             currency: order.currency,
//             receipt: order.receipt,
//             status: 'created',  
//         });
//         writeData(orders);

//         res.json(order);
//     } catch (err) {
//         console.error('Create Order Error:', err);
//         res.status(500).json('Create Order Error');
//     }
// });




// app.post('/verify-payment', (req, res) => {
//     console.log("I am in verify payment",)
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     console.log(razorpay_order_id,razorpay_payment_id,razorpay_signature)   
//     const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
//     hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
//     const expectedSignature = hmac.digest('hex');

//     if (expectedSignature === razorpay_signature) {
//         res.json({ success: true, message: "Payment verified successfully." });
//     } else {
//         res.status(400).json({ success: false, message: "Payment verification failed." });
//     }
// });



// app.post('/payment-success', (req, res) => {
//     res.status(200).json({ success: true, message: "Payment successful" });
// });




// app.post('/payment-failed', (req, res) => {
//     // Handle failure logic here
//     res.send("Payment failed! Please try again.");
// });



// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });
