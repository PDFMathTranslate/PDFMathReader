export function registerFontRoutes(app, { installedFonts }) {
  app.get('/api/fonts', async (_req, res) => {
    try {
      res.json(await installedFonts.list());
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Failed' });
    }
  });
}
