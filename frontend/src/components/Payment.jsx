import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Payment = () => {
    const [amount, setAmount] = useState('');
    const navigate = useNavigate();

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const payNow = async () => {
        const res = await loadRazorpay();
        if (!res) {
            alert("Razorpay SDK failed to load.");
            return;
        }

        const response = await fetch("http://localhost:5000/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: Number(amount) * 100, // Razorpay needs amount in paise
                currency: "INR",
                receipt: `receipt_${Date.now()}`
            }),
        });

        if (!response.ok) {
            alert("Failed to create order.");
            return;
        }

        const order = await response.json();

        const options = {
            key: 'rzp_test_TNCzXddhPoGggJ', // Replace with your Razorpay key
            amount: order.amount,
            currency: order.currency,
            name: 'Your Business Name',
            description: 'Payment for Order',
            order_id: order.id,
            handler: async function (response) {
                const verifyRes = await fetch("http://localhost:5000/verify-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                    }),
                });

                const verifyData = await verifyRes.json();

                if (verifyRes.ok && verifyData.success) {
                    alert("Payment verified successfully!");
                    navigate("/payment-success");
                } else {
                    alert("Payment verification failed.");
                    navigate("/payment-failed");
                }
            },
            prefill: {
                name: 'Customer Name',
                email: 'customer@example.com',
                contact: '9999999999'
            },
            theme: { color: '#111166' }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

        rzp.on("payment.failed", function (response) {
            console.error("Payment failed", response.error);
            navigate("/payment-failed");
        });
    };

    return (
        <div className="flex justify-center items-center h-screen bg-gray-100">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center w-96">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Razorpay Payment</h2>

                <label className="block text-gray-600 mt-4">Amount (in ₹):</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full p-2 mt-2 border rounded text-center"
                    placeholder="Enter amount"
                />

                <button
                    onClick={payNow}
                    className="mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
                >
                    Pay Now
                </button>
            </div>
        </div>
    );
};

export default Payment;
