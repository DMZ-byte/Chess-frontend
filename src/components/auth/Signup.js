import React,{ useState }  from "react";
import { useNavigate, useNavigationType } from "react-router-dom";
import * as api from '../../api/api';
import axios from "axios";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';


function Signup(){
    const [username,setUsername] = useState('');
    const [password,setPassword] = useState('');
    const [confirmPassword,setConfirmPassword] = useState('');
    const [error,setError] = useState('');
    const [loading,setLoading] = useState(false);
    const [successMessage,setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (event) => {
        event.preventDefault();
        setError('');
        setSuccessMessage('');

        if(password !== confirmPassword){
            setError("Passwords do not match");
            return;
        }
        if(password.length < 6){
            setError('Password must be longer than 5 characters');
            return;
        }
        setLoading(true);
        try{
            const userData = await api.registerUser(username,password);
            console.log('Registration successful:');
            setSuccessMessage('Registration successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            },2000);
            }  catch (err) {
            console.error("An error occured while trying to register new user" + err);
            const serverMessage = err || "An unknown error occurred.";
            setError(serverMessage);
            }

         finally {
            setLoading(false);
        }
    };
    return (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 px-4">
    <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
      <h2 className="text-2xl font-bold text-center text-purple-700 mb-6">Sign Up</h2>
      
      <form onSubmit={handleSignup} id="form1" className="space-y-5">
        <div>
          <label htmlFor="username" className="block text-gray-700 font-medium mb-1">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-1">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm font-medium">{error}</p>
        )}

        {successMessage && (
          <p className="text-green-600 text-sm font-medium">{successMessage}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          form="form1"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
        >
          {loading ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-600 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-purple-600 hover:underline font-medium">
          Login here
        </Link>
      </p>
    </div>
  </div>
);

}
export default Signup;