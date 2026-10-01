import type {
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class BrowserflowStudioOAuth2Api implements ICredentialType {
  name = "browserflowStudioOAuth2Api";
  extends = ["oAuth2Api"];
  displayName = "Browserflow OAuth2 API";
  icon = "file:../nodes/Browserflow/browserflow.svg" as const;
  documentationUrl =
    "https://github.com/browserflow-io/n8n-nodes-browser-flow#credentials";
  properties: INodeProperties[] = [
    {
      displayName: "Allowed HTTP Request Domains",
      name: "allowedHttpRequestDomains",
      type: "hidden",
      default: "all",
    },
    {
      displayName: "Allowed Domains",
      name: "allowedDomains",
      type: "hidden",
      default: "",
    },
    {
      displayName: "Browserflow URL",
      name: "baseUrl",
      type: "hidden",
      default: "https://browserflow.io",
    },
    {
      displayName: "Grant Type",
      name: "grantType",
      type: "hidden",
      default: "pkce",
    },
    {
      displayName: "Authorization URL",
      name: "authUrl",
      type: "hidden",
      default: '={{$self["baseUrl"] + "/oauth/authorize"}}',
    },
    {
      displayName: "Access Token URL",
      name: "accessTokenUrl",
      type: "hidden",
      default: '={{$self["baseUrl"] + "/oauth/token"}}',
    },
    {
      displayName: "Client ID",
      name: "clientId",
      type: "hidden",
      default: "browserflow-n8n",
    },
    {
      displayName: "Client Secret",
      name: "clientSecret",
      typeOptions: { password: true },
      type: "hidden",
      default: "",
      required: false,
    },
    {
      displayName: "Scope",
      name: "scope",
      type: "hidden",
      default: "flows:read flows:run runs:read",
    },
    {
      displayName: "Auth URI Query Parameters",
      name: "authQueryParameters",
      type: "hidden",
      default: "",
    },
    {
      displayName: "Authentication",
      name: "authentication",
      type: "hidden",
      default: "body",
    },
  ];
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "/api/v1/flows",
      method: "GET",
    },
  };
}
