import React from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';

import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen'; // NOVO: Importamos a tela
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ServiceSelectionScreen from './src/screens/ServiceSelectionScreen';
import BookingScreen from './src/screens/BookingScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import AccountScreen from './src/screens/AccountScreen';
import StoreScreen from './src/screens/StoreScreen';

import AdminNavigator from './src/navigation/AdminNavigator';
import AdminBlockTimeScreen from './src/screens/admin/AdminBlockTimeScreen';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user, profile, isAdmin, loading } = useAuth();

  if (loading) {
      return (
        <View style={{flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center'}}>
           <ActivityIndicator size="large" color="#D4A373" />
        </View>
      );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: '#121212' } }}>
      {!user ? (
        // NOVO: Agrupamos Login e ForgotPassword na área de "usuários deslogados"
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : !profile?.full_name || !profile?.phone ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          {isAdmin ? (
             <Stack.Screen name="AdminDashboard" component={AdminNavigator} />
          ) : (
             <Stack.Screen name="Home" component={HomeScreen} />
          )}
          <Stack.Screen name="ServiceSelection" component={ServiceSelectionScreen} />
          <Stack.Screen name="Booking" component={BookingScreen} />
          <Stack.Screen name="Appointments" component={AppointmentsScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Store" component={StoreScreen} />
          <Stack.Screen name="Success" component={SuccessScreen} options={{ gestureEnabled: false }} />
          {isAdmin && <Stack.Screen name="AdminBlockTime" component={AdminBlockTimeScreen} />}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}