import { useDispatch } from "react-redux";
import { getUserData } from "../https";
import { useEffect, useState } from "react";
import { removeUser, setUser } from "../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase/client";

const useLoadData = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await getUserData();
        const { _id, name, email, phone, role } = data.data;
        dispatch(setUser({ _id, name, email, phone, role }));
      } catch (error) {
        dispatch(removeUser());
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();

    // Listen to Supabase auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const { data } = await getUserData();
          const { _id, name, email, phone, role } = data.data;
          dispatch(setUser({ _id, name, email, phone, role }));
        } catch {
          // ignore
        }
      } else if (event === "SIGNED_OUT") {
        dispatch(removeUser());
        navigate("/auth");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [dispatch, navigate]);

  return isLoading;
};

export default useLoadData;
