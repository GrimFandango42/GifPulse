declare module 'giphy-api' {
  interface GiphyOptions {
    https?: boolean;
    timeout?: number;
    apiKey?: string;
  }

  interface SearchOptions {
    q: string;
    limit?: number;
    offset?: number;
    rating?: string;
    lang?: string;
    fmt?: string;
  }

  interface GiphyResponse {
    data: {
      type: string;
      id: string;
      url: string;
      bitly_gif_url: string;
      bitly_url: string;
      embed_url: string;
      username: string;
      source: string;
      title: string;
      rating: string;
      content_url: string;
      source_tld: string;
      source_post_url: string;
      is_sticker: number;
      import_datetime: string;
      trending_datetime: string;
      images: {
        original: {
          height: string;
          width: string;
          size: string;
          url: string;
          mp4_size: string;
          mp4: string;
          webp_size: string;
          webp: string;
          frames: string;
          hash: string;
        };
        [key: string]: any;
      };
    }[];
    pagination: {
      total_count: number;
      count: number;
      offset: number;
    };
    meta: {
      status: number;
      msg: string;
      response_id: string;
    };
  }

  type GiphyCallback = (err: Error | null, res: GiphyResponse) => void;

  interface GiphyAPI {
    (options?: GiphyOptions | string): GiphyAPI;
    search(options: SearchOptions): Promise<GiphyResponse>;
    search(options: SearchOptions, callback: GiphyCallback): void;
    id(ids: string | string[]): Promise<GiphyResponse>;
    id(ids: string | string[], callback: GiphyCallback): void;
    translate(options: { s: string, rating?: string, lang?: string }): Promise<GiphyResponse>;
    translate(options: { s: string, rating?: string, lang?: string }, callback: GiphyCallback): void;
    random(options: { tag?: string, rating?: string, fmt?: string }): Promise<GiphyResponse>;
    random(options: { tag?: string, rating?: string, fmt?: string }, callback: GiphyCallback): void;
    trending(options: { limit?: number, rating?: string, fmt?: string }): Promise<GiphyResponse>;
    trending(options: { limit?: number, rating?: string, fmt?: string }, callback: GiphyCallback): void;
  }

  const giphy: GiphyAPI;
  export default giphy;
}