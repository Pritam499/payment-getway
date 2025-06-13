import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Payment from "./components/Payment";
import PaymentSuccess from "./components/PaymentSuccess";
import PaymentFailed from "./components/PaymentFailed";
import "./App.css";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Payment />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/payment-failed" element={<PaymentFailed />} />
            </Routes>
        </Router>
    );
}

export default App;
