import ImageGenerationCard from "./ImageGenerationCard";
import IngestionStatusCard from "./IngestionStatusCard";
import UploadProgressCard from "./UploadProgressCard";
import UrlIngestionCard from "./UrlIngestionCard";
import VideoGenerationCard from "./VideoGenerationCard";

export default function StreamsChatCardRenderer({ card, actions = {} }) {
  if (!card) return null;

  if (card.type === "image_generation" || card.type === "image_edit") {
    return <ImageGenerationCard image={card.image} {...actions} />;
  }

  if (card.type === "video_generation") {
    return <VideoGenerationCard video={card.video} {...actions} />;
  }

  if (card.type === "upload_progress") {
    return <UploadProgressCard upload={card.upload} />;
  }

  if (card.type === "ingestion_status") {
    return <IngestionStatusCard job={card.job} />;
  }

  if (card.type === "url_ingestion" || card.type === "youtube_ingestion") {
    return <UrlIngestionCard item={card.item} />;
  }

  if (card.type === "error") {
    return <div role="alert">{card.message}</div>;
  }

  return <div>Unsupported card type: {card.type}</div>;
}
