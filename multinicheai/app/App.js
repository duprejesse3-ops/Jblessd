// App.js
// Entry point. One codebase for phone (Expo) and Windows (wrap this same
// Expo web build in Tauri or Electron — see WINDOWS.md).
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthScreen from "./screens/AuthScreen";
import ChatScreen from "./screens/ChatScreen";
import CreditsScreen from "./screens/CreditsScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Credits" component={CreditsScreen} options={{ title: "Buy credits" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
