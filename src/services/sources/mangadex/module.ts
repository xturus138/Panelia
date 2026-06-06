import { MangaDexProvider } from './impl';

export const mangadexModule = {
  id: 'mangadex',
  name: 'MangaDex',
  provider: new MangaDexProvider(),
};
