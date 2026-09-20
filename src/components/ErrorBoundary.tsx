import { Component, ErrorInfo, ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Keeps the kiosk alive when a render throws. Before this, a single bad value
 * (e.g. a malformed album thumb URL) would unmount the entire app and leave a
 * black screen with no way to recover without reloading (upstream issue #12).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("What's Playing crashed while rendering:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            backgroundColor: "black",
            color: "white",
            padding: "5%",
            textAlign: "center",
          }}
        >
          <Typography variant="h5">Something went wrong</Typography>
          {this.state.message && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {this.state.message}
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="contained" onClick={() => window.location.assign("/")}>
              Back to players
            </Button>
            <Button variant="outlined" color="secondary" onClick={() => window.location.assign("/config")}>
              Settings
            </Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}
