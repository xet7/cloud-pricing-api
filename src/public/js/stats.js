(() => {
  function fillEndpoint() {
    document.getElementById(
      'cloud-pricing-api-endpoint'
    ).innerText = window.location.href.replace(/\/$/, '');
  }

  function checkLatestVersion() {
    fetch(
      `https://api.github.com/repos/infracost/cloud-pricing-api/releases/latest`
    )
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        }
        throw new Error('Error fetching latest version from GitHub');
      })
      .then((data) => {
        const latestVersion = data.tag_name.substr(1);

        // eslint-disable-next-line no-underscore-dangle
        if (latestVersion !== window.__CLOUD_PRICING_API_VERSION__) {
          document.getElementById('version-warning').innerHTML = `
          <p><img src="/img/warning.svg" class="icon" alt="Warning" /> Cloud Pricing API is using an old version. The latest version is v${latestVersion}.</p>
        `;
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
      });
  }

  function showStats() {
    const apiKey = document.getElementById('api-key-input').value;
    const priceUpdateThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    fetch('/stats', {
      headers: {
        'X-Api-Key': apiKey,
      },
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        }
        if (response.status === 403) {
          throw new Error('Invalid API key');
        } else {
          throw new Error('Error fetching stats');
        }
      })
      .then((data) => {
        document.getElementById('stats-results').innerHTML = `
        <table class="stats-table">
          <tr>
            <th>Installed</th>
            <td>${new Date(data.createdAt).toLocaleString()}</td>
          </tr>
          <tr>
            <th>Prices last updated</th>
            <td>
              ${new Date(data.pricesLastSuccessfullyUpdatedAt).toLocaleString()}
              ${
                new Date(data.pricesLastSuccessfullyUpdatedAt).getTime() <
                new Date().getTime() - priceUpdateThreshold
                  ? '<img src="/img/warning.svg" class="status-icon" /> <span>Prices haven\'t been updated for over 7 days</span>'
                  : ''
              }
            </td>
          </tr>
          <tr>
            <th>Last price update was successful</th>
            <td><img src="/img/${
              data.pricesLastUpdateSuccessful ? 'check.svg' : 'cross.svg'
            }" class="icon status" alt="${
          data.pricesLastUpdateSuccessful ? 'Success' : 'Failed'
        }" /></td>
          </tr>
          <tr>
            <th>Total runs</th>
            <td>${data.totalRuns}</td>
          </tr>
          <tr>
            <th>Total CLI user runs</th>
            <td>${data.nonCiRuns}</td>
          </tr>
          <tr>
            <th>Total CI/CD system runs</th>
            <td>${data.ciRuns}</td>
          </tr>
          <tr>
            <th>CLI users installed</th>
            <td>${data.nonCiInstalls}</td>
          </tr>
        </table>
      `;
      })
      .catch((error) => {
        document.getElementById('stats-results').innerHTML = `
        <span class="error">Error: ${error.message}</span>
      `;
      });
  }

  document.getElementById('api-key-submit').onclick = showStats;
  fillEndpoint();
  checkLatestVersion();
})();