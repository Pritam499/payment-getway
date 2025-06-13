import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const PaymentFailed = () => {
    const navigate = useNavigate();

    useEffect(() => {
        setTimeout(() => {
            navigate("/");
        }, 5000);
    }, [navigate]);

    return (
        <div className="flex justify-center items-center h-screen bg-red-100">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                <h2 className="text-2xl font-bold text-red-600">Payment Failed</h2>
                <p className="text-gray-600 mt-2">Oops! Something went wrong. Please try again.</p>
            </div>
        </div>
    );
};

export default PaymentFailed;
