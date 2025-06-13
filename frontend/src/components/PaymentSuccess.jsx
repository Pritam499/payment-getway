import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PaymentSuccess = () => {
    const navigate = useNavigate();

    useEffect(() => {
        setTimeout(() => {
            navigate("/");
        }, 5000);
    }, [navigate]);

    return (
        <div className="flex justify-center items-center h-screen bg-green-100">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold text-green-600">Payment Successful!</h2>
                <p className="text-gray-600 mt-2">Thank you for your payment.</p>
            </div>
        </div>
    );
};

export default PaymentSuccess;
