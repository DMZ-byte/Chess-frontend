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
            console.log('Registration successful:',userData);
            setSuccessMessage('Registration successful! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            },2000);
        } catch (errorMessage){
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };
    return(
        <div>
            <h2>
                Sign Up
            </h2>
            <form onSubmit={handleSignup} id="form1">
                <div>
                    <label htmlFor="username">
                        Username: 
                    </label>
                    <input 
                    type="text"
                    value={username}
                    id="username"
                    onChange={(e) => setUsername(e.target.value)} required/>

                </div>
                <div>
                    <label htmlFor="password">Password</label>
                    <input type="password" id="password" value={password} 
                    onChange={(e) => setPassword(e.target.value)} required/>

                </div>
                <div>
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input 
                    type="password" 
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    />
                </div>
                {error && <p>{error}</p>}
                {successMessage && <p>{successMessage}</p>}
                <button type="submit" disabled={loading} form="form1">
                    {loading ? 'Signing up...' : 'Sign Up'}
                </button>
            </form>
            <p>
                Alredy have an account? <Link to="/login">Login here</Link>
            </p>
        </div>
    );
}
export default Signup;