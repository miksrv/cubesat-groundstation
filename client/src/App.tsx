import React from 'react';
import { Provider } from 'react-redux';
import { store } from './app/store';
import Dashboard from './components/Dashboard/Dashboard';
import './styles/global.scss';

const App: React.FC = () => (
  <Provider store={store}>
    <Dashboard />
  </Provider>
);

export default App;
