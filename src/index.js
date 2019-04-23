const path = require('path');
const uuid = require('uuid/v1');
const registerTask = require('./task');
const screenshotMatches = require('./screenshotMatches');

const DEFAULT_MATCH_FOLDER = 'cypress/match-screenshots';

// Take screenshot, return path asynchonously.
function takeScreenshot({ blackout, capture }, cb) {
  let newImage;
  cy
    .screenshot(uuid(), {
      log: false,
      onAfterScreenshot($el, props) {
        newImage = props.path;
      },
      blackout,
      capture
    })
    .then(() => {
      cb(newImage);
    });
}


const getPaths = (fileName) => {
  const stableSetDirRelative = Cypress.config('matchScreenshotsFolder') || DEFAULT_MATCH_FOLDER;
  const stableSetDir = path.join(Cypress.config('fileServerFolder'), stableSetDirRelative);
  const stableImagePath = path.join(stableSetDir, fileName + '.png');
  const diffDir = path.join(stableSetDir, 'diff');
  const diffImagePath = path.join(diffDir, fileName + '.png');

  return {
    stableSetDir,
    stableImagePath,
    diffDir,
    diffImagePath
  };
};

const attemptToMatch =
  (fileName, { threshold, thresholdType, maxRetries, blackout, capture }, cb) => {
    const { stableImagePath, diffImagePath, diffDir } = getPaths(fileName);

    // Ensure that the diff folder exists
    cy.task('mkdir', diffDir);


    cy.log('Taking screenshot');
    takeScreenshot({ blackout, capture }, (newImage) => {
      screenshotMatches({
        oldImage: stableImagePath,
        newImage: newImage,
        target: diffImagePath,
        threshold,
        thresholdType
      }, (matches) => {
        if (matches || maxRetries < 1) {
          cb({ matches, newImage });
        } else {
          // Try again
          cy.task('unlink', newImage);
          attemptToMatch(fileName, { threshold, thresholdType, maxRetries: maxRetries - 1, blackout, capture }, cb);
        }
      });
    });
  };

const makeStable = (fileName, newImage) => {
  const { stableImagePath, diffImagePath } = getPaths(fileName);
  cy.log('Updating stable set');
  cy.task('rename', {
    from: newImage,
    to: stableImagePath
  });
  cy.task('unlink', diffImagePath);
};

const hasStableImage = (fileName) => {
  const { stableImagePath } = getPaths(fileName);

  return cy.task('exists', stableImagePath);
};

/**
 * Takes a screenshot and, if available, matches it against the screenshot
 * from the previous test run. Assertion will fail if the diff is larger than
 * the specified threshold
 * @param  {String} name
 * @param  {Object} options
 */
function matchScreenshot(
  name, { threshold = '0', thresholdType = 'percent', maxRetries = 3, blackout = [], capture = 'fullPage' } = {}) {
  const fileNameParts = [this.test.parent.title, this.test.title];
  if (typeof name === 'string') {
    fileNameParts.push(name);
  }
  const fileName = fileNameParts.join(' -- ');

  hasStableImage(fileName)
    .then((hasStable) => {
      if (hasStable) {
        attemptToMatch(fileName, { threshold, thresholdType, maxRetries, blackout, capture },
          ({ matches, newImage }) => {
            const shouldUpdateStableSet = Cypress.env('updateScreenshots');
            if (shouldUpdateStableSet) {
              if (matches) {
                cy.log('Screenshots match');
                cy.task('unlink', newImage);
              } else {
                makeStable(fileName, newImage);
              }
            }
            if (!shouldUpdateStableSet) {
              cy.task('unlink', newImage)
                .then(() => { assert.isTrue(matches, 'Screenshots match'); });

            }
          });

      } else {
        // Does not have existing screenshot
        cy.log('Taking new screenshot');
        takeScreenshot({ blackout, capture }, (newImage) => makeStable(fileName, newImage));
      }
    });

}
/**
 * Register `matchScreenshot` custom command
 * @param  {String} - optional custom name for command
 * @param  {String} - optional custom root dir path
 */
function register (commandName = 'matchScreenshot') {
  Cypress.Commands.add(commandName, matchScreenshot);
}

module.exports = { register, registerTask };