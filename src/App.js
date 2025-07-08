import logo from './logo.svg';
import {BrowserRouter as Router,Routes,Route} from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Router>
      <div className='App'>
        <Routes>
          <Route path='/' element={<HomePage />}></Route>
          <Route path='/games/:gameId' element={<GamePage />}></Route>
          <Route path='*' element={<NotFoundPage />}></Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
