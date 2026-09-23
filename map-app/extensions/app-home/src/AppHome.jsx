import {render} from 'preact';
import {LocationProvider, Router, Route} from 'preact-iso';
import HomePage from './pages/HomePage.jsx';
import LocationsPage from './pages/LocationsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default async () => {
  render(
    <LocationProvider>
      <s-app-nav>
        <s-link href="/">Overview</s-link>
        <s-link href="/locations">Locations</s-link>
        <s-link href="/settings">Settings</s-link>
      </s-app-nav>
      <Router>
        <Route path="/" component={HomePage} />
        <Route path="/locations" component={LocationsPage} />
        <Route path="/settings" component={SettingsPage} />
      </Router>
    </LocationProvider>,
    document.body,
  );
};
