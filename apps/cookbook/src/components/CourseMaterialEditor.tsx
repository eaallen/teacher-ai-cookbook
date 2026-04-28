import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import { Paper } from "@mui/material";
import { useEffect, useRef } from "react";

export function CourseMaterialEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (md: string) => void;
}) {
  const ref = useRef<MDXEditorMethods | null>(null);

  // Sync if the parent replaces markdown wholesale (e.g., loaded from
  // Firestore after the editor mounted).
  useEffect(() => {
    if (ref.current && ref.current.getMarkdown() !== markdown) {
      ref.current.setMarkdown(markdown);
    }
  }, [markdown]);

  return (
    <Paper variant="outlined" sx={{ "& .mdxeditor": { minHeight: 360 } }}>
      <MDXEditor
        ref={ref}
        markdown={markdown}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          codeBlockPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <ListsToggle />
                <CreateLink />
              </>
            ),
          }),
        ]}
      />
    </Paper>
  );
}
