import React from 'react';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-white text-gray-800 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 border-b pb-2 border-gray-200">
          About Us
        </h1>
        <p className="text-lg mb-6">
          Welcome to our project! This platform was built with passion and purpose
          to deliver a seamless experience to our users. Whether you're here to play, learn, or connect, we aim to make your journey smooth, secure, and fun.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-2">🎯 Our Mission</h2>
        <p className="mb-6">
          To build intuitive, real-time web applications that bring people together
          through shared interests, strategic games, and meaningful interactions.
        </p>

        <h2 className="text-2xl font-semibold mt-8 mb-2">🛠️ Tech Stack</h2>
        <ul className="list-disc list-inside mb-6">
          <li>React & Tailwind CSS for the frontend</li>
          <li>Spring Boot & WebSockets for backend matchmaking</li>
          <li>STOMP over SockJS for real-time communication</li>
          <li>PostgreSQL for data storage</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-8 mb-2">👨‍💻 The Developer</h2>
        <p>
          This project was created by Filip Domazetovski, a passionate software engineer from North Macedonia
          with interests in full-stack development, DevOps, and AI. The project is an evolving playground
          for new ideas and technologies.
        </p>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} Filip Domazetovski. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
