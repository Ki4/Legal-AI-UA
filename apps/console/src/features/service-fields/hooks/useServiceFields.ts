// One service's questionnaire dictionary, plus the four writes that maintain it.
//
// `notFound` is its own field rather than an error key, because a mistyped id
// and a broken request call for different reactions from the reader (DoD §4). A
// service that exists and has no fields is neither — that is the empty state.
//
// Every write keeps its own error, and they are separate on purpose: a failed
// reorder must not put "could not save the field" on screen, because the reader
// did not try to save a field. §6 of the DoD asks for that in one line; four
// pieces of state are what it costs.

import { useCallback, useEffect, useState } from "react";
import type { TranslationKey } from "@legal-ai/i18n";
import { AppError } from "../../../shared/api/errors";
import {
  serviceFieldsApi,
  type FieldEdit,
  type NewQuestionnaireField,
  type ServiceFieldsPage,
} from "../api";

export interface ServiceFieldsState {
  page: ServiceFieldsPage | null;
  loading: boolean;
  notFound: boolean;
  errorKey: TranslationKey | null;
  saving: boolean;
  saveErrorKey: TranslationKey | null;
  removingId: string | null;
  removeErrorKey: TranslationKey | null;
  movingId: string | null;
  moveErrorKey: TranslationKey | null;
  createField: (input: NewQuestionnaireField) => Promise<boolean>;
  updateField: (input: FieldEdit) => Promise<boolean>;
  removeField: (fieldId: string) => Promise<void>;
  moveField: (fieldId: string, direction: "up" | "down") => Promise<void>;
  reload: () => void;
}

function loadErrorKey(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "serviceFields.error.load";

  switch (cause.code) {
    case "forbidden":
      return "serviceFields.error.forbidden";
    case "network":
      return "serviceFields.error.network";
    default:
      return "serviceFields.error.load";
  }
}

function saveErrorKeyFor(cause: unknown): TranslationKey {
  if (!(cause instanceof AppError)) return "serviceFields.save.error.save";

  switch (cause.code) {
    case "validation":
      return "serviceFields.save.error.validation";
    case "forbidden":
      return "serviceFields.save.error.forbidden";
    case "conflict":
      return "serviceFields.save.error.conflict";
    case "network":
      return "serviceFields.save.error.network";
    default:
      return "serviceFields.save.error.save";
  }
}

export function useServiceFields(serviceId: string): ServiceFieldsState {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<ServiceFieldsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErrorKey, setSaveErrorKey] = useState<TranslationKey | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeErrorKey, setRemoveErrorKey] = useState<TranslationKey | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveErrorKey, setMoveErrorKey] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKey(null);
    setNotFound(false);

    serviceFieldsApi
      .listForService(serviceId)
      .then((result) => {
        if (!cancelled) setPage(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // Cleared before the new outcome is shown: fields from the previous
        // service rendered next to this one's error read as this one's answer
        // (DoD §5).
        setPage(null);
        if (cause instanceof AppError && cause.code === "not_found") {
          setNotFound(true);
          return;
        }
        setErrorKey(loadErrorKey(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceId, attempt]);

  const createField = useCallback(async (input: NewQuestionnaireField) => {
    setSaving(true);
    setSaveErrorKey(null);

    try {
      const created = await serviceFieldsApi.create(input);
      setPage((current) =>
        current === null ? current : { ...current, fields: [...current.fields, created] },
      );
      return true;
    } catch (cause: unknown) {
      setSaveErrorKey(saveErrorKeyFor(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateField = useCallback(async (input: FieldEdit) => {
    setSaving(true);
    setSaveErrorKey(null);

    try {
      const saved = await serviceFieldsApi.update(input);
      setPage((current) =>
        current === null
          ? current
          : {
              ...current,
              fields: current.fields.map((field) => (field.id === saved.id ? saved : field)),
            },
      );
      return true;
    } catch (cause: unknown) {
      setSaveErrorKey(saveErrorKeyFor(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const removeField = useCallback(async (fieldId: string) => {
    setRemovingId(fieldId);
    setRemoveErrorKey(null);

    try {
      const removed = await serviceFieldsApi.remove(fieldId);
      // Dropped only once the write is known to have happened. A row removed
      // optimistically and put back by the next load reads as a bug rather than
      // as the refusal it is — which is why `remove` returns an id, not void.
      setPage((current) =>
        current === null
          ? current
          : { ...current, fields: current.fields.filter((field) => field.id !== removed) },
      );
    } catch (cause: unknown) {
      setRemoveErrorKey(
        cause instanceof AppError && cause.code === "forbidden"
          ? "serviceFields.delete.forbidden"
          : "serviceFields.delete.error",
      );
    } finally {
      setRemovingId(null);
    }
  }, []);

  const moveField = useCallback(async (fieldId: string, direction: "up" | "down") => {
    setMovingId(fieldId);
    setMoveErrorKey(null);

    try {
      const fields = await serviceFieldsApi.move(fieldId, direction);
      // The whole list, not the two rows that swapped: positions are re-derived,
      // so any row's number may have changed.
      setPage((current) => (current === null ? current : { ...current, fields }));
    } catch {
      setMoveErrorKey("serviceFields.move.error");
    } finally {
      setMovingId(null);
    }
  }, []);

  return {
    page,
    loading,
    notFound,
    errorKey,
    saving,
    saveErrorKey,
    removingId,
    removeErrorKey,
    movingId,
    moveErrorKey,
    createField,
    updateField,
    removeField,
    moveField,
    reload: () => setAttempt((current) => current + 1),
  };
}
