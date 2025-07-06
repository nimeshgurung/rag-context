import React, { createContext, useState, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';

interface DialogState {
  open: boolean;
  title: string;
  message: string;
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface DialogContextType {
  showDialog: (title: string, message: string) => void;
  hideDialog: () => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    message: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showDialog = useCallback((title: string, message: string) => {
    setDialog({ open: true, title, message });
  }, []);

  const hideDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, message, onConfirm });
    },
    [],
  );

  const hideConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    hideConfirm();
  };

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog, showConfirm }}>
      {children}
      <AlertDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        onClose={hideDialog}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onClose={hideConfirm}
        onConfirm={handleConfirm}
      />
    </DialogContext.Provider>
  );
};
