import { useAuthStore } from '@/store/authStore';

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth, callback) => {
    callback(null);
    return () => undefined;
  }),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve()),
  createUserWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({
      user: {
        uid: 'user-1',
        email: 'test@example.com',
        displayName: null,
      },
    }),
  ),
  updateProfile: jest.fn(() => Promise.resolve()),
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'server-time'),
}));

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: {},
  firestore: {},
}));

const authModule = require('firebase/auth');
const mockSignIn = authModule.signInWithEmailAndPassword as jest.Mock;

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      initializing: true,
      isSubmitting: false,
      errorMessage: null,
    });
  });

  it('initializes auth state', async () => {
    useAuthStore.getState().initialize();
    await flushPromises();
    expect(useAuthStore.getState().initializing).toBe(false);
  });

  it('logs in successfully', async () => {
    await useAuthStore.getState().login('test@example.com', 'secret');
    expect(mockSignIn).toHaveBeenCalled();
    expect(useAuthStore.getState().errorMessage).toBeNull();
  });

  it('handles login errors', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('auth/invalid-credential'));
    await useAuthStore.getState().login('bad@example.com', 'bad');
    expect(useAuthStore.getState().errorMessage).toBe('Invalid email or password.');
  });
});
