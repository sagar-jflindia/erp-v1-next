import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials, selectUser } from "@/features/authSlice";
import { io } from "socket.io-client";

export const useSocket = (userId) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  useEffect(() => {
    if (!userId) return;

    const socket = io("http://localhost:8000", { withCredentials: true });

    socket.on("connect", () => {
      console.log("Connected to socket server");
    });

    socket.on("permissions_updated", (permissions) => {
      if (user) {
        dispatch(
          setCredentials({
            ...user,
            permissions,
          }),
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);
};
