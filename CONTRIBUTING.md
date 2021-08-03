# Development

**Prerequisites**:

  * Node.js version >= 14.15.0
  * Postgres version >= 13

1. Clone the repo:

    ```sh
    git clone https://github.com/infracost/cloud-pricing-api.git
    cd cloud-pricing-api
    ```

2. Use the [Infracost CLI](https://github.com/infracost/infracost/blob/master/README.md#quick-start) to get an API key so your self-hosted Cloud Pricing API can download the latest pricing data from us:

    ```sh
    infracost register
    ```
    The key is saved in `~/.config/infracost/credentials.yml`.

3. Generate a 32 character API token that your Infracost CLI users will use to authenticate when calling your self-hosted Cloud Pricing API. If you ever need to rotate the API key, you can simply update this environment variable and restart the application.

    ```sh
    export SELF_HOSTED_INFRACOST_API_KEY=$(cat /dev/urandom | env LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    echo "SELF_HOSTED_INFRACOST_API_KEY=$SELF_HOSTED_INFRACOST_API_KEY"
    ```

4. Add a `.env` file with the following content:

    ```sh
    # Don't forget to run `CREATE DATABASE cloud_pricing;` first.
    POSTGRES_URI=postgresql://postgres:my_password@localhost:5432/cloud_pricing
    
    # The Infracost API from Step 2, used to download pricing data from us.
    INFRACOST_API_KEY=<API Key from Step 2>

    # The API key you generated in step 3, used to authenticate Infracost CLI users with your self-hosted Cloud Pricing API.
    SELF_HOSTED_INFRACOST_API_KEY=<API Key from Step 3>
    ```

5. Install the npm packages:

    ```sh
    npm install
    ```

6. Download the pricing data, this can take a few minutes. The second command will show the number of products in the DB (each product has multiple prices).
   
    ```sh
    npm run job:init && npm run data:status:dev
    ```

7. Keep prices up to date by running the update job once a week, for example from cron:

    ```sh
    npm run job:update

    # Cron: add a cron job to run every week to update the database data. The cron entry should look something like:
    0 4 * * SUN npm run-script job:update >> /var/log/cron.log 2>&1
    ```

8. Start the server:

    In development mode:
    ```sh
    npm run dev
    ```

    In production mode:
    ```sh
    npm run build
    npm run start
    ```

    `curl -i http://localhost:4000/health` should show success.

9. To configure the Infracost CLI to use your self-hosted Cloud Pricing API, you can use:

    ```sh
    export INFRACOST_PRICING_API_ENDPOINT=http://localhost:4000
    export INFRACOST_API_KEY=$SELF_HOSTED_INFRACOST_API_KEY
    
    infracost breakdown --path /path/to/code
    ```

    You can also access the GraphQL Playground at [http://localhost:4000/graphql](http://localhost:4000/graphql) using something like the [modheader](https://bewisse.com/modheader/) browser extension so you can set the custom HTTP header `X-API-KEY` to your `SELF_HOSTED_INFRACOST_API_KEY`.

# Release

[@alikhajeh1](https://github.com/alikhajeh1) and [@aliscott](https://github.com/aliscott) rotate release responsibilities between them.

1. In the cloud-pricing-api repo, run `git tag vx.y.z && git push origin vx.y.z`
2. Wait for the GH Actions to complete.
3. Click on the Edit draft button, set the `vx.y.z` value in the tag name and release title. Also add the release notes from the commits between this and the last release and click on publish.
4. Follow the Helm chart [release steps](https://github.com/infracost/helm-charts/blob/master/CONTRIBUTING.md).
5. Announce the release in the infracost-community Slack announcements channel.
6. Update the docs repo with any required changes.
7. Close addressed issues and tag anyone who liked/commented in them to tell them it's live in version X.
