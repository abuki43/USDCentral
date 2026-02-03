jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      firebase: {
        apiKey: 'test-api-key',
        projectId: 'test-project',
        appId: 'test-app-id',
      },
    },
  },
}));
