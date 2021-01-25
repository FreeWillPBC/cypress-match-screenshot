module.exports = ({
  oldImage, newImage, target, threshold, thresholdType,
}, cb) => {
  // Blink is used via the command line instead of via node
  // Due to dependencies that cause issue with Cypress' bundler.

  cy.exec(`blink-diff \
      --output "${target}" \
      --threshold "${threshold}" \
      --threshold-type ${thresholdType} \
      "${oldImage}" "${newImage}"`, {
    failOnNonZeroExit: false,
    log: false,
  })
    .then(({ code, stderr }) => {
      if (stderr) {
        throw stderr;
      }
      else {
        cb(code === 0);
      }
    });
};
