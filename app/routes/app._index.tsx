import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { syncProductMetafieldsForBundleItems } from "../utils/metafields.server";
import { syncConsolidatedDiscountNode } from "../utils/settings.server";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  IndexTable,
  EmptyState,
  Badge,
  Button,
  InlineStack,
  Icon,
} from "@shopify/polaris";
import { DragHandleIcon } from '@shopify/polaris-icons';
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const bundles = await prisma.bundle.findMany({
    where: { shop: session.shop },
    orderBy: { priority: "desc" },
  });
  return { bundles };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;

    // Fetch bundle to get products for metafield cleanup
    const bundle = await prisma.bundle.findUnique({
      where: { id, shop: session.shop },
      include: { items: true }
    });

    if (bundle) {
      // 1. Delete from DB FIRST so the sync query doesn't find it
      await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
      await prisma.bundle.delete({ where: { id } });

      // 2. Re-sync metafields for products touched by removed direct/collection items.
      if (bundle.items.length > 0) {
        await syncProductMetafieldsForBundleItems(bundle.items, admin, session.shop);
      }

      // Rebuild consolidated node after bundle deletion.
      await syncConsolidatedDiscountNode(session.shop, admin);

    }
  } else if (intent === "reorder") {
    const orderedIds = JSON.parse(formData.get("orderedIds") as string) as string[];

    // The highest priority is at index 0, so priority is length - index
    const updatePromises = orderedIds.map((id, index) => {
      const priority = orderedIds.length - index;
      return prisma.bundle.update({
        where: { id, shop: session.shop },
        data: { priority }
      });
    });

    await Promise.all(updatePromises);
  }

  return json({ success: true });
};

export default function Index() {
  const { bundles: initialBundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [bundles, setBundles] = useState(initialBundles);

  // Sync state if loader data changes (e.g., after delete)
  useEffect(() => {
    setBundles(initialBundles);
  }, [initialBundles]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setBundles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Fire request to server to save new order
        submit(
          {
            intent: "reorder",
            orderedIds: JSON.stringify(newOrder.map(i => i.id))
          },
          { method: "post" }
        );

        return newOrder;
      });
    }
  }, [submit]);

  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first bundle"
      action={{
        content: "Create bundle",
        onAction: () => navigate("/app/bundles/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Configure bundle offers to increase your average order value.</p>
    </EmptyState>
  );

  return (
    <Page>
      <TitleBar title="BundleKit">
        <button variant="primary" onClick={() => navigate("/app/bundles/new")}>
          Create bundle
        </button>
        <button onClick={() => navigate("/app/settings")}>
          ⚙️ Settings
        </button>
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card padding="0">
              {bundles.length === 0 ? (
                emptyStateMarkup
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <IndexTable
                    resourceName={{ singular: "bundle", plural: "bundles" }}
                    itemCount={bundles.length}
                    headings={[
                      { title: "" }, // Drag handle column
                      { title: "Title" },
                      { title: "Type" },
                      { title: "Status" },
                      { title: "Discount" },
                      { title: "Actions" },
                    ]}
                    selectable={false}
                  >
                    <SortableContext
                      items={bundles.map(b => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {bundles.map((bundle, index) => (
                        <SortableRow
                          key={bundle.id}
                          bundle={bundle}
                          index={index}
                          navigate={navigate}
                          submit={submit}
                        />
                      ))}
                    </SortableContext>
                  </IndexTable>
                </DndContext>
              )}
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

// Child component for Sortable Rows to handle refs exactly
function SortableRow({ bundle, index, navigate, submit }: { bundle: any, index: number, navigate: any, submit: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bundle.id });

  // Use a ref callback to grab the TR element for the drop zone collision,
  // while keeping the TD as the drag activator.
  const handleActivatorRef = (node: HTMLElement | null) => {
    setActivatorNodeRef(node);
    if (node) {
      const tr = node.closest('tr');
      if (tr) {
        setNodeRef(tr);
      }
    }
  };

  // Combine DndKit's positional snap transition with our custom visual transitions
  const dndTransition = transition
    ? `${transition}, box-shadow 0.2s ease, background-color 0.2s ease`
    : 'box-shadow 0.2s ease, background-color 0.2s ease';

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: dndTransition,
    ...(isDragging ? {
      position: 'relative',
      zIndex: 9999,
      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
      backgroundColor: 'var(--p-color-bg-surface-hover)',
      opacity: 0.95,
      display: 'table-row',
    } : {
      zIndex: 1,
    })
  } as React.CSSProperties;

  return (
    // @ts-ignore - Polaris IndexTable.Row types don't officially support 'style', but it passes through to the underlying HTML tr element
    <IndexTable.Row id={bundle.id} position={index} style={style}>
      <td
        ref={handleActivatorRef}
        {...attributes}
        {...listeners}
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          padding: "10px",
          width: "40px",
          textAlign: "center"
        }}
      >
        <Icon source={DragHandleIcon} tone="base" />
      </td>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {bundle.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{bundle.type}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={bundle.status === "ACTIVE" ? "success" : "info"}>
          {bundle.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {String(bundle.discountValue)}{" "}
        {bundle.discountType === "PERCENTAGE" ? "%" : "off"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="300" wrap={false}>
          {/* Add pointerEvents: none during drag so buttons aren't accidentally triggered */}
          <div style={{ pointerEvents: isDragging ? 'none' : 'auto', display: 'flex', gap: '8px' }}>
            <Button onClick={() => navigate(`/app/bundles/${bundle.id}`)} size="micro">Edit</Button>
            <Button
              tone="critical"
              onClick={() => submit({ intent: "delete", id: bundle.id }, { method: "post" })}
              size="micro"
            >
              Delete
            </Button>
          </div>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}
