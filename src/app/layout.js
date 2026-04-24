import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import ReduxProvider from "@/components/ReduxProvider";
import SocketProvider from "@/components/SocketProvider";

export const metadata = {
  title: "JFL IT Services",
  description: "JFL IT Solutions.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ReduxProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </ReduxProvider>
      </body>
    </html>
  );
}