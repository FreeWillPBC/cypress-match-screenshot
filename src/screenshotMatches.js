module.exports = function({ oldImage, newImage, target, threshold, thresholdType }) {
  return new Promise((resolve, reject) => {

    // Blink is used via the command line instead of via node
    // Due to dependencies that cause issue with Cypress' bundler.

    cy.exec(`blink-diff \
      --output "${target}" \
      --threshold "${threshold}" \
      --threshold-type ${thresholdType} \
      "${oldImage}" "${newImage}"`, {
      failOnNonZeroExit: false,
      log: false
    })
      .then(({ code, stderr }) => {
        if (stderr) {
          reject(stderr);
        } else {
          resolve(code === 0);
        }
      });
  });
};
