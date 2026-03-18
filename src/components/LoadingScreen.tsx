interface LoadingScreenProps {
  visible: boolean;
}

export const LoadingScreen = ({ visible }: LoadingScreenProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-card">
        <h2>Entering The Hoard</h2>
        <p>Stoking embers, waking the dragon, arranging relics...</p>
      </div>
    </div>
  );
};
