const path = require('path');

const uuid = require('uuid/v1');

const screenshotMatches = require('./screenshotMatches');
const registerTask = require('./task');

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
      capture,
    })
    .then(() => {
      cb(newImage);
    });
}

const getPaths = (fileName) => {
  const stableSetDirRelative = Cypress.config('matchScreenshotsFolder') || DEFAULT_MATCH_FOLDER;
  const stableSetDir = path.join(Cypress.config('fileServerFolder'), stableSetDirRelative);
  const stableImagePath = path.join(stableSetDir, `${fileName}.png`);
  const diffDir = path.join(stableSetDir, 'diff');
  const diffImagePath = path.join(diffDir, `${fileName}.png`);
  const newDir = path.join(stableSetDir, 'new');
  const newImagePath = path.join(newDir, `${fileName}.png`);

  return {
    diffDir,
    diffImagePath,
    newDir,
    newImagePath,
    stableImagePath,
    stableSetDir,
  };
};

const attemptToMatch = (fileName, {
  threshold, thresholdType, maxRetries, blackout, capture,
}, cb) => {
  const { stableImagePath, diffImagePath, diffDir } = getPaths(fileName);

  // Ensure that the diff folder exists
  cy.task('mkdir', diffDir);

  cy.log('Taking screenshot');
  takeScreenshot({ blackout, capture }, (newImage) => {
    screenshotMatches({
      oldImage: stableImagePath,
      newImage,
      target: diffImagePath,
      threshold,
      thresholdType,
    }, (matches) => {
      if (matches || maxRetries < 1) {
        if (matches) {
          // Delete diffs that don't show anything
          cy.task('unlink', diffImagePath);
        }
        cb({ matches, newImage });
      }
      else {
        // Try again
        cy.task('unlink', newImage);
        attemptToMatch(fileName, {
          threshold, thresholdType, maxRetries: maxRetries - 1, blackout, capture,
        }, cb);
      }
    });
  });
};

const makeStable = (fileName, newImage) => {
  const { stableImagePath, diffImagePath } = getPaths(fileName);
  cy.log('Updating stable set');
  cy.task('rename', {
    from: newImage,
    to: stableImagePath,
  });
  cy.task('unlink', diffImagePath);
};

const hasStableImage = (fileName) => {
  const { stableImagePath } = getPaths(fileName);

  return cy.task('exists', stableImagePath);
};

// All non-matching new images are copied here for inspection by the user
// These files are not used by this program.
const copyToNewDir = (fileName, newImage, cb) => {
  const { newDir, newImagePath } = getPaths(fileName);
  cy.task('mkdir', newDir)
    .then(() => {
      cy.task('copy', { from: newImage, to: newImagePath })
        .then(() => {
          if (cb) {
            cb();
          }
        });
    });
};

const buildFileName = (name, test) => {
  const fileNameParts = [];
  if (name) {
    fileNameParts.push(name);
  }
  let currentTest = test;
  while (currentTest) {
    fileNameParts.push(currentTest.title);
    currentTest = currentTest.parent;
  }
  return fileNameParts.reverse().join(' -- ');
};

/**
 * Takes a screenshot and, if available, matches it against the screenshot
 * from the previous test run. Assertion will fail if the diff is larger than
 * the specified threshold
 * @param  {Object} options
 */
function matchScreenshot({
  name = '', threshold = '0', thresholdType = 'percent', maxRetries = 2, blackout = [], capture = 'fullPage',
} = {}) {
  const fileName = buildFileName(name, this.test);

  hasStableImage(fileName)
    .then((hasStable) => {
      if (hasStable) {
        attemptToMatch(fileName, {
          threshold, thresholdType, maxRetries, blackout, capture,
        },
        ({ matches, newImage }) => {
          const shouldUpdateStableSet = Cypress.env('updateScreenshots');
          if (shouldUpdateStableSet) {
            if (matches) {
              cy.log('Screenshots match');
              cy.task('unlink', newImage);
            }
            else {
              copyToNewDir(fileName, newImage, () => {
                makeStable(fileName, newImage);
              });
            }
          }
          if (!shouldUpdateStableSet) {
            const deleteScreenshotAndAssertMatch = () => cy.task('unlink', newImage)
              .then(() => { assert.isTrue(matches, 'Screenshots match'); });

            if (matches) {
              deleteScreenshotAndAssertMatch();
            }
            else {
              copyToNewDir(fileName, newImage, deleteScreenshotAndAssertMatch);
            }
          }
        });
      }
      else {
        // Does not have existing screenshot
        cy.log('Taking new screenshot');
        takeScreenshot({ blackout, capture }, (newImage) => {
          copyToNewDir(fileName, newImage);
          makeStable(fileName, newImage);
        });
      }
    });
}
/**
 * Register `matchScreenshot` custom command
 * @param commandName {String} - optional custom name for command
 */
function register(commandName = 'matchScreenshot') {
  Cypress.Commands.add(commandName, matchScreenshot);
}

module.exports = { register, registerTask };
