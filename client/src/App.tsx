import React from 'react';
import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from './contexts/AuthContext'; // Assuming path
import { queryClient } from "./lib/queryClient";

import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import LoginPage from './pages/LoginPage'; // Assuming path
import RegisterPage from './pages/RegisterPage'; // Assuming path
import { SettingsScreen } from './components/SettingsScreen'; // Assuming path
import { GifWizard } from './components/GifWizard'; // Assuming path

// ProtectedRoute component
const ProtectedRoute: React.FC<{ component: React.ComponentType<any>; path?: string }> = ({ component: Component, ...rest }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    // Optional: return a loading spinner or null while checking auth state
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }

  return <Route {...rest} component={Component} />;
};


function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      
      {/* Example of protecting specific components/pages */}
      <ProtectedRoute path="/wizard" component={GifWizard} />
      <ProtectedRoute path="/settings" component={SettingsScreen} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function Header() {
  const { user, logout, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // Redirect to home after logout
    } catch (error) {
      console.error("Logout failed:", error);
      // Handle logout error (e.g., show a toast)
    }
  };

  return (
    <header className="p-4 bg-muted text-muted-foreground">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <a className="text-lg font-semibold hover:text-primary">GIF Wizard App</a>
        </Link>
        <nav className="flex items-center space-x-4">
          {isLoading ? (
            <p>Loading...</p>
          ) : user ? (
            <>
              <span className="text-sm">Welcome, {user.username}!</span>
              <Link href="/settings"><Button variant="ghost" size="sm">Settings</Button></Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button variant="default" size="sm">Register</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider> {/* AuthProvider wraps everything */}
        <TooltipProvider>
          <Toaster />
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8">
              <AppRoutes />
            </main>
            <footer className="p-4 bg-muted text-muted-foreground text-center text-sm">
              © {new Date().getFullYear()} GIF Wizard Inc.
            </footer>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
