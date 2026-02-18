import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Chores from "@/pages/Chores";
import Rewards from "@/pages/Rewards";
import Badges from "@/pages/Badges";
import ParentPanel from "@/pages/ParentPanel";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chores" component={Chores} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/badges" component={Badges} />
      <Route path="/parent" component={ParentPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
