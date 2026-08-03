import {
  createDrizzleLineRichMenuRepository,
  GetLineRichMenuAdminState,
  HttpLineRichMenuProvider,
  type LineRichMenuProviderFactory,
  PublishLineRichMenu,
} from "@shime/integrations";
import { getLineChannelAccessToken } from "./line-provider";
import { SharpLineRichMenuImageRenderer } from "./line-rich-menu-image";

export function createLineRichMenuUseCases() {
  const repository = createDrizzleLineRichMenuRepository();
  const providers: LineRichMenuProviderFactory = {
    async get(tenantId) {
      return new HttpLineRichMenuProvider(await getLineChannelAccessToken(tenantId));
    },
  };
  return {
    getState: new GetLineRichMenuAdminState(repository),
    publish: new PublishLineRichMenu(repository, providers, new SharpLineRichMenuImageRenderer()),
  };
}
