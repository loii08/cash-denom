# Cash Denomination Tracker

A modern web application for tracking physical cash transactions with intelligent denomination breakdowns for Philippine pesos.

## 🚀 Features

### 💰 Cash Transaction Management
- **Denomination Tracking**: Track cash by individual Philippine peso denominations (₱1000, ₱500, ₱200, ₱100, ₱50, ₱20, ₱10, ₱5, ₱1)
- **Auto Calculation**: Automatically calculate totals from denomination breakdowns
- **Transaction History**: View, edit, and delete past transactions
- **Date Tracking**: Record transaction dates and timestamps

### 👤 User Authentication
- **Google Sign-In**: Secure authentication with Google accounts
- **Data Privacy**: User-specific data isolation and security
- **Session Management**: Persistent login state across sessions

### 📱 Progressive Web App
- **Offline Support**: IndexedDB persistence for offline functionality
- **Mobile Optimized**: Responsive design for all device sizes
- **Installable**: Native app-like experience on supported devices
- **Real-time Sync**: Automatic data synchronization when online

### 📊 Activity Logging
- **Audit Trail**: Complete log of all user actions (Create, Update, Delete)
- **Transaction History**: Detailed breakdown of changes over time
- **Error Handling**: Comprehensive error tracking and reporting

## 🛠 Technology Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS v4
- **Backend**: Firebase (Firestore + Authentication)
- **UI Components**: Lucide React icons
- **Animations**: Motion library
- **PWA**: Vite PWA plugin with service worker

## 📁 Project Structure

```
CashDenomTracker/
├── src/
│   ├── App.tsx          # Main application component
│   ├── firebase.ts      # Firebase configuration
│   ├── types.ts         # TypeScript type definitions
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── public/
│   ├── icon-192.svg     # PWA icon (192x192)
│   └── icon-512.svg     # PWA icon (512x512)
├── .vercelignore        # Deployment exclusions
├── firestore.rules      # Firebase security rules
├── vercel.json          # Vercel deployment config
└── vite.config.ts       # Vite build configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Account (for authentication)

### Local Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   Configure your Firebase credentials in `.env.local`

3. **Run development server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

### Build & Deployment

**Build for production**
```bash
npm run build:check
```

**Deploy to Vercel**
```bash
npm run deploy:preview  # Preview deployment
npm run deploy:prod     # Production deployment
```

## 🔧 Configuration

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Google Sign-In)
3. Set up Firestore database
4. Configure environment variables:
   ```bash
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_FIRESTORE_DATABASE_ID=your_database_id
   ```

### Domain Authorization

Add your deployment domain to Firebase Console:
- Authentication → Settings → Authorized domains
- Add `localhost:3000` for development
- Add `*.vercel.app` for production

## 📱 Usage

1. **Sign In**: Use Google authentication to access the app
2. **Add Transaction**: Enter cash amounts by denomination
3. **View History**: Browse past transactions and activities
4. **Edit/Delete**: Modify or remove existing transactions
5. **Offline Mode**: Continue tracking without internet connection

## 🔒 Security Features

- **Content Security Policy**: Restricts resource loading
- **Firebase Security Rules**: Server-side data validation
- **Environment Variable Validation**: Prevents misconfiguration
- **HTTPS Only**: Secure data transmission
- **User Data Isolation**: Complete separation of user data

## 📊 Data Model

### Transaction
```typescript
interface Transaction {
  id?: string;
  date: Date;
  breakdown: Breakdown;     // { 1000: 2, 500: 1, 100: 3, ... }
  total: number;
  uid: string;
}
```

### Activity Log
```typescript
interface ActivityLog {
  id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  details: {
    total: number;
    breakdown: Breakdown;
    transactionId?: string;
  };
  uid: string;
}
```

## 🚦 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:check` | Lint and build |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type checking |
| `npm run clean` | Clean build artifacts |
| `npm run deploy:prod` | Deploy to production |
| `npm run deploy:preview` | Deploy preview |

## 🌟 Features in Detail

### Smart Denomination Entry
- Input cash amounts by individual bill/coin types
- Real-time total calculation
- Validation for denomination combinations
- Quick entry for common amounts

### Real-time Synchronization
- Instant updates across multiple devices
- Conflict resolution for simultaneous edits
- Offline queue for pending changes
- Automatic retry on connection restoration

### Activity Monitoring
- Complete audit trail of all operations
- Filterable history by date range
- Transaction change tracking
- Error logging and recovery

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## 📞 Support

For support or questions:
- Create an issue in the repository
- Check the documentation
- Review the Firebase configuration guide
