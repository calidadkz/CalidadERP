
export const showNotification = (type: 'success' | 'error' | 'info', message: string, description?: string) => {
  console.log(`Notification (${type}): ${message}${description ? ' - ' + description : ''}`);
  // TODO: Integrate with an actual notification library (e.g., react-toastify, antd notifications)
  alert(`${type.toUpperCase()}: ${message}\n${description || ''}`);
};
