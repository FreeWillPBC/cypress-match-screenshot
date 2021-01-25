// -- Example Usage: 
// -- cypress/tsconfig.json
// {
//   "compilerOptions": {
//      "types": ["cypress", "cypress-match-screenshot"]
//    }
// }

declare namespace Cypress {
    interface MatchScreenshotOptions {
        name?: string;
        threshold?: number;
        thresholdType?: 'pixel' | 'percent';
        blackout?: string[];
        maxRetries?: number;
        capture?: 'fullPage' | 'viewport' | 'runner'
    }

    interface Chainable<Subject = any> {
        matchScreenshot(options?: MatchScreenshotOptions): Chainable<null>;
    }
}
