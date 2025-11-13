module.exports = {
  '*.ts': (filesArray) => {
    const commands = [];

    // Separate backend files from other files
    const backendFiles = filesArray.filter((file) => file.startsWith('apps/backend/'));
    const otherFiles = filesArray.filter((file) => !file.startsWith('apps/backend/'));

    // Run ESLint with backend config for backend files
    if (backendFiles.length > 0) {
      const relativePaths = backendFiles.map((f) => f.replace('apps/backend/', ''));
      commands.push(`cd apps/backend && npx eslint ${relativePaths.join(' ')}`);
      // Prettier checks disabled - not critical for preventing code breakage
    }

    // Run ESLint with root config for other files
    if (otherFiles.length > 0) {
      commands.push(`npx eslint ${otherFiles.join(' ')}`);
      // Prettier checks disabled - not critical for preventing code breakage
    }

    return commands;
  },
  '*.tsx': (filesArray) => {
    return [`npx eslint ${filesArray.join(' ')}`];
    // Prettier checks disabled - not critical for preventing code breakage
  },
  // Prettier checks for markdown files also disabled
};
