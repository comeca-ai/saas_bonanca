import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { trpc } from "./lib/trpc";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/livestock" component={Home} />
    <Route path="/livestock/:id" component={Home} />
    <Route path="/operations" component={Home} />
    <Route path="/imports" component={Home} />
    <Route path="/core" component={Home} />
    <Route path="/data-control" component={Home} />
    <Route path="/catalog" component={Home} />
    <Route path="/audit" component={Home} />
    <Route path="/settings" component={Home} />
    <Route path="/growth-calculator" component={Home} />
    <Route path="/saas-admin" component={Home} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function AppContent() {
  const me = trpc.auth.me.useQuery();
  if (me.isLoading) return <div className="app-loading"><span className="spinner" /><span>Preparando seu workspace…</span></div>;
  if (!me.data) return <Login />;
  return <Router />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><AppContent /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
