import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LibraryDetailPage from './pages/LibraryDetailPage';
import Layout from './components/Layout';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { DialogProvider } from './context/DialogProvider';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <DialogProvider>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="library" element={<LibraryDetailPage />} />
            <Route path="library/:libraryId" element={<LibraryDetailPage />} />
          </Route>
        </Routes>
      </DialogProvider>
    </ThemeProvider>
  );
}

export default App;
