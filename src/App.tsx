import { Route, Switch, useLocation } from "wouter";
import { useUserStore } from "./store/store";
import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { MediaPlayers } from "./views/MediaPlayers";
import MusicLibrary from "./views/MusicLibrary";
import { Configuration } from "./views/Configuration";
import { Notification } from "./components/Notification";
import { useEffect } from "react";
import { Spinner } from "./components/Spinner.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { theme } from "./theme";

function App() {
  const { configuration, loadConfig } = useUserStore((state) => state);

  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!configuration.loaded) {
      loadConfig().then((config) => {
        if (!config.plexToken) {
          setLocation("/config");
        }
      });
    }
  }, [configuration.loaded, loadConfig, setLocation]);

  if (!configuration.loaded) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Spinner open />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box>
        <Notification />
        <ErrorBoundary>
        <Switch>
          <Route path="/config">
            <Configuration />
          </Route>

          <Route path="/albums">
            <MusicLibrary />
          </Route>

          <Route path="/">
            <MediaPlayers />
          </Route>

          {/* Default route in a switch */}
          <Route>404: No such page!</Route>
        </Switch>
        </ErrorBoundary>
      </Box>
    </ThemeProvider>
  );
}

export default App;
