const path = require('path');
const uuid = require('uuid/v1');
const registerTask = require('./task');
const screenshotMatches = require('./screenshotMatches');
const promisify = require('cypress-promise');

const DEFAULT_MATCH_FOLDER = 'cypress/match-screenshots';

// Take screenshot, return path asynchonously.
async function takeScreenshot({ blackout, capture }) {
  let newImage = null;
  await promisify(cy
    .screenshot(uuid(), {
      log: false,
      onAfterScreenshot($el, props) {
        // Store path of screenshot that has been taken
        // This is a reliable way for moving that screenshot file
        //  in the next step!
        newImage = props.path;
      },
      blackout,
      capture
    }));
  return newImage;
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
  async (fileName, { threshold, thresholdType, maxRetries, blackout, capture }) => {
    let matches = false;
    let attempt = 0;
    let newImage;

    const { stableImagePath, diffImagePath, diffDir } = getPaths(fileName);

    // Ensure that the diff folder exists
    cy.task('mkdir', diffDir);

    while (!matches && attempt++ < maxRetries) {

      cy.log('Taking screenshot');
      newImage = await takeScreenshot({ blackout, capture });
      matches = await screenshotMatches({
        oldImage: stableImagePath,
        newImage: newImage,
        target: diffImagePath,
        threshold,
        thresholdType
      });
    }

    return { newImage, matches };
  };

const makeStable = async (fileName, newImage) => {
  const { stableImagePath, diffImagePath } = getPaths(fileName);
  cy.log('Updating stable set');
  await cy.task('rename', {
    from: newImage,
    to: stableImagePath
  });
  await cy.task('unlink', diffImagePath);
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
async function matchScreenshot(
  name, { threshold = '0', thresholdType = 'percent', maxRetries = 3, blackout = [], capture = 'fullPage' } = {}) {
  const fileNameParts = [this.test.parent.title, this.test.title];
  if (typeof name === 'string') {
    fileNameParts.push(name);
  }
  const fileName = fileNameParts.join(' -- ');

  if (await hasStableImage(fileName)) {
    const { matches, newImage } =
      await attemptToMatch(fileName, { threshold, thresholdType, maxRetries, blackout, capture });

    const shouldUpdateStableSet = Cypress.config('updateScreenshots');
    if (shouldUpdateStableSet) {
      if (matches) {
        cy.log('Screenshots match');
        cy.task('unlink', newImage);
      } else {
        makeStable(fileName, newImage);
      }
    }

    if (!shouldUpdateStableSet) {
      assert.isTrue(matches, 'Screenshots match');
    }

  } else {
    // Does not have existing screenshot
    cy.log('Taking new screenshot');
    const newImage = await takeScreenshot({ blackout, capture });
    makeStable(fileName, newImage);
  }
}
/**
 * Register `matchScreenshot` custom command
 * @param  {String} - optional custom name for command
 * @param  {String} - optional custom root dir path
 */
function register (commandName = 'matchScreenshot') {
  // This pass-through function makes it not return a promise, shutting up Cypress's warning system about commands that return promises.
  Cypress.Commands.add(commandName, function () {
    matchScreenshot.apply(this, arguments);
  });
}

module.exports = { register, registerTask };