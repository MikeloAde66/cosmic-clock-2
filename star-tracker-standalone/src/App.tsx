import StarTrackerView from './components/StarTrackerView';

// The only view this app has — no nav, no header/footer, no other tabs.
// Mirrors the choice already made for the Next.js app's own standalone
// /star-tracker route: "Back" has nothing else on this domain to return
// to, so it sends the visitor to the real main hub instead of a dead button.
export default function App() {
  return (
    <StarTrackerView
      onBack={() => {
        window.location.href = 'https://aione.protolabsglobal.com';
      }}
    />
  );
}
