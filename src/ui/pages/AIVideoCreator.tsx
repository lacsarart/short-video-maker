import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  LinearProgress,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MovieIcon from "@mui/icons-material/Movie";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface AIScene {
  text: string;
  searchTerms: string[];
}

interface AIVideoScript {
  scenes: AIScene[];
  config: {
    voice: string;
    music: string;
    captionPosition: string;
    captionBackgroundColor: string;
    orientation: string;
    paddingBack: number;
    musicVolume: string;
  };
}

type Step = "input" | "generating" | "preview" | "submitting" | "done";

const AIVideoCreator: React.FC = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [script, setScript] = useState<AIVideoScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setError(null);
    setStep("generating");
    try {
      const { data } = await axios.post<AIVideoScript>("/api/ai-script", {
        topic: topic.trim(),
      });
      setScript(data);
      setStep("preview");
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      setError(msg);
      setStep("input");
    }
  };

  const handleSubmit = async () => {
    if (!script) return;
    setError(null);
    setStep("submitting");
    try {
      const { data } = await axios.post<{ videoId: string }>(
        "/api/short-video",
        script,
      );
      setVideoId(data.videoId);
      setStep("done");
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : err instanceof Error
            ? err.message
            : "Unknown error";
      setError(msg);
      setStep("preview");
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <AutoAwesomeIcon color="primary" fontSize="large" />
        <Typography variant="h4" component="h1">
          AI Video Creator
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Type a topic and Claude will write a video script, pick the right voice,
        music, and colors — then submit it for rendering.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 1: Topic input */}
      {(step === "input" || step === "generating") && (
        <Paper sx={{ p: 3 }}>
          <TextField
            fullWidth
            label="What's your video about?"
            placeholder="e.g. the history of the Eiffel Tower, how black holes form, morning yoga routine..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={step === "generating"}
            multiline
            rows={2}
            sx={{ mb: 3 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && topic.trim()) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          {step === "generating" ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography color="text.secondary">
                Claude is writing your script…
              </Typography>
              <LinearProgress sx={{ mt: 2 }} />
            </Box>
          ) : (
            <Button
              variant="contained"
              size="large"
              startIcon={<AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={!topic.trim()}
              fullWidth
            >
              Generate Script with Claude
            </Button>
          )}
        </Paper>
      )}

      {/* Step 2: Script preview */}
      {(step === "preview" || step === "submitting") && script && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Generated Script
            </Typography>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
              <Chip label={`Voice: ${script.config.voice}`} size="small" />
              <Chip label={`Music: ${script.config.music}`} size="small" />
              <Chip
                label={`Orientation: ${script.config.orientation}`}
                size="small"
              />
              <Chip
                label={`Captions: ${script.config.captionPosition}`}
                size="small"
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {script.scenes.map((scene, i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  color="primary"
                  gutterBottom
                >
                  Scene {i + 1}
                </Typography>
                <Typography variant="body1" sx={{ mb: 0.5 }}>
                  {scene.text}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {scene.searchTerms.map((term) => (
                    <Chip
                      key={term}
                      label={term}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Paper>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setScript(null);
                setStep("input");
              }}
              disabled={step === "submitting"}
            >
              Start Over
            </Button>
            <Button
              variant="contained"
              size="large"
              startIcon={
                step === "submitting" ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <MovieIcon />
                )
              }
              onClick={handleSubmit}
              disabled={step === "submitting"}
              sx={{ flexGrow: 1 }}
            >
              {step === "submitting" ? "Submitting…" : "Render This Video"}
            </Button>
          </Box>
        </>
      )}

      {/* Step 3: Done */}
      {step === "done" && videoId && (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Video queued!
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your video is rendering. Track its progress on the details page.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button
              variant="contained"
              onClick={() => navigate(`/video/${videoId}`)}
            >
              Track Progress
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setTopic("");
                setScript(null);
                setVideoId(null);
                setStep("input");
              }}
            >
              Make Another
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default AIVideoCreator;
