export const Loading = ({ text = 'Đang tải...' }) => <p className="muted">{text}</p>;
export const ErrorBox = ({ message }) => (message ? <div className="alert error">{message}</div> : null);
