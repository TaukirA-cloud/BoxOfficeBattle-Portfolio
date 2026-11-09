import { createApplication } from '../server/index.js';
import { movies } from '../server/game.js';
export default async function setup() {
  const { server } = createApplication({
    database: ':memory:',
    production: false,
    quiet: true,
    trustProxy: false,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(3100, '127.0.0.1', resolve);
  });
  // Separate, credential-free fixture service for testing remote image presentation.
  const posters = createApplication({
    database: ':memory:',
    production: false,
    quiet: true,
    trustProxy: false,
  });
  posters.catalog.publish(
    movies.map((movie) => ({
      ...movie,
      id: `tmdb:${movie.id}`,
      source: 'tmdb',
      posterUrl: `https://image.tmdb.org/t/p/w780/test_${movie.id}.jpg`,
    })),
  );
  await new Promise((resolve, reject) => {
    posters.server.once('error', reject);
    posters.server.listen(3101, '127.0.0.1', resolve);
  });
  return async () => {
    posters.server.closeAllConnections();
    await new Promise((resolve) => posters.server.close(resolve));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
}
