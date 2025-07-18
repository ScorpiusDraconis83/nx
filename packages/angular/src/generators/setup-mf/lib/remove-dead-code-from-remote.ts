import type { Tree } from '@nx/devkit';
import { joinPathFragments, readProjectConfiguration } from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { NormalizedOptions } from '../schema';

export function removeDeadCodeFromRemote(
  tree: Tree,
  options: NormalizedOptions
) {
  const projectName = options.appName;
  const project = readProjectConfiguration(tree, projectName);
  const sourceRoot = getProjectSourceRoot(project, tree);

  const { appComponentInfo, nxWelcomeComponentInfo, entryModuleFileName } =
    options;

  ['css', 'less', 'scss', 'sass'].forEach((style) => {
    const pathToComponentStyle = joinPathFragments(
      sourceRoot,
      `app/${appComponentInfo.extensionlessFileName}.${style}`
    );
    if (tree.exists(pathToComponentStyle)) {
      tree.delete(pathToComponentStyle);
    }
  });

  tree.rename(
    nxWelcomeComponentInfo.path,
    joinPathFragments(
      sourceRoot,
      `app/remote-entry/${nxWelcomeComponentInfo.fileName}`
    )
  );
  tree.delete(
    joinPathFragments(
      sourceRoot,
      `app/${appComponentInfo.extensionlessFileName}.spec.ts`
    )
  );
  tree.delete(
    joinPathFragments(
      sourceRoot,
      `app/${appComponentInfo.extensionlessFileName}.html`
    )
  );
  if (!options.standalone) {
    const componentContents = tree.read(appComponentInfo.path, 'utf-8');
    const isInlineTemplate = !componentContents.includes('templateUrl');

    const component =
      componentContents.split(
        isInlineTemplate ? 'template' : 'templateUrl'
      )[0] +
      `template: '<router-outlet></router-outlet>'

})
export class ${appComponentInfo.symbolName} {}`;

    tree.write(appComponentInfo.path, component);

    let modulePath = joinPathFragments(sourceRoot, 'app/app.module.ts');
    if (!tree.exists(modulePath)) {
      modulePath = joinPathFragments(sourceRoot, 'app/app-module.ts');
    }
    tree.write(
      modulePath,
      `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ${appComponentInfo.symbolName} } from './${appComponentInfo.extensionlessFileName}';

@NgModule({
  declarations: [${appComponentInfo.symbolName}],
  imports: [
    BrowserModule,
    RouterModule.forRoot([{
      path: '',
      loadChildren: () => import('./remote-entry/${entryModuleFileName}').then(m => m.RemoteEntryModule)
    }], { initialNavigation: 'enabledBlocking' }),
  ],
  providers: [],
  bootstrap: [${appComponentInfo.symbolName}],
})
export class AppModule {}`
    );
  } else {
    tree.delete(appComponentInfo.path);

    const pathToIndexHtml = project.targets.build.options.index;
    const indexContents = tree.read(pathToIndexHtml, 'utf-8');
    const rootSelectorRegex = new RegExp(
      `${options.prefix || 'app'}-root`,
      'ig'
    );
    const remoteEntrySelector = `${
      options.prefix || 'app'
    }-${projectName}-entry`;
    const newIndexContents = indexContents.replace(
      rootSelectorRegex,
      remoteEntrySelector
    );

    tree.write(pathToIndexHtml, newIndexContents);
  }
}
