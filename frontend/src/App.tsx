import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LibraryDetailPage from './pages/LibraryDetailPage';
import Layout from './components/Layout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryDetailPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

export default App;
