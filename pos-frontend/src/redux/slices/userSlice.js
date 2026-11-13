import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    _id: "",
    name: "",
    username: "",
    email: "",
    phone: "",
    role: "",
    isAuth: false
}

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            const { _id, name, username, phone, email, role } = action.payload;
            state._id = _id;
            state.name = name;
            state.username = username || "";
            state.phone = phone;
            state.email = email;
            state.role = role;
            state.isAuth = true;
        },

        removeUser: (state) => {
            state._id = "";
            state.username = "";
            state.email = "";
            state.name = "";
            state.phone = "";
            state.role = "";
            state.isAuth = false;
        }
    }
})

export const { setUser, removeUser } = userSlice.actions;
export default userSlice.reducer;