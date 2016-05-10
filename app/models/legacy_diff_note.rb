class LegacyDiffNote < Note
  serialize :st_diff

  validates :line_code, presence: true, line_code: true

  before_create :set_diff

  class << self
    def build_discussion_id(noteable_type, noteable_id, line_code, active = true)
      [super(noteable_type, noteable_id), line_code, active].join("-")
    end
  end

  def diff_note?
    true
  end

  def legacy_diff_note?
    true
  end

  def discussion_id
    @discussion_id ||= self.class.build_discussion_id(noteable_type, noteable_id || commit_id, line_code, active?)
  end

  def find_diff
    return nil unless noteable
    return @diff if defined?(@diff)

    # Don't use ||= because nil is a valid value for @diff
    @diff = noteable.diffs(Commit.max_diff_options).find do |d|
      Digest::SHA1.hexdigest(d.new_path) == diff_file_index if d.new_path
    end
  end

  def set_diff
    # First lets find notes with same diff
    # before iterating over all mr diffs
    diff = diff_for_line_code unless for_merge_request?
    diff ||= find_diff

    self.st_diff = diff.to_hash if diff
  end

  def diff
    @diff ||= Gitlab::Git::Diff.new(st_diff) if st_diff.respond_to?(:map)
  end

  def diff_for_line_code
    attributes = {
      noteable_type: noteable_type,
      line_code: line_code
    }

    if for_commit?
      attributes[:commit_id] = commit_id
    else
      attributes[:noteable_id] = noteable_id
    end

    self.class.where(attributes).last.try(:diff)
  end

  # Check if this note is part of an "active" discussion
  #
  # This will always return true for anything except MergeRequest noteables,
  # which have special logic.
  #
  # If the note's current diff cannot be matched in the MergeRequest's current
  # diff, it's considered inactive.
  def active?
    return true if for_commit?
    return true unless self.diff
    return false unless noteable
    return @active if defined?(@active)

    noteable_diff = find_noteable_diff

    if noteable_diff
      parsed_lines = Gitlab::Diff::Parser.new.parse(noteable_diff.diff.each_line)

      @active = parsed_lines.any? { |line_obj| line_obj.text == diff_line }
    else
      @active = false
    end

    @active
  end

  def diff_file_index
    line_code.split('_')[0] if line_code
  end

  def diff_file_name
    diff.new_path if diff
  end

  def file_path
    if diff.new_path.present?
      diff.new_path
    elsif diff.old_path.present?
      diff.old_path
    end
  end

  def diff_old_line
    line_code.split('_')[1].to_i if line_code
  end

  def diff_new_line
    line_code.split('_')[2].to_i if line_code
  end

  def generate_line_code(line)
    Gitlab::Diff::LineCode.generate(file_path, line.new_pos, line.old_pos)
  end

  def diff_line
    return @diff_line if @diff_line

    if diff
      diff_lines.each do |line|
        if generate_line_code(line) == self.line_code
          @diff_line = line.text
        end
      end
    end

    @diff_line
  end

  def diff_line_type
    return @diff_line_type if @diff_line_type

    if diff
      diff_lines.each do |line|
        if generate_line_code(line) == self.line_code
          @diff_line_type = line.type
        end
      end
    end

    @diff_line_type
  end

  def truncated_diff_lines
    max_number_of_lines = 16
    prev_match_line = nil
    prev_lines = []

    highlighted_diff_lines.each do |line|
      if line.type == "match"
        prev_lines.clear
        prev_match_line = line
      else
        prev_lines << line

        break if generate_line_code(line) == self.line_code

        prev_lines.shift if prev_lines.length >= max_number_of_lines
      end
    end

    prev_lines
  end

  def diff_lines
    @diff_lines ||= Gitlab::Diff::Parser.new.parse(diff.diff.each_line)
  end

  def highlighted_diff_lines
    Gitlab::Diff::Highlight.new(diff_lines).highlight
  end

  private

  # Find the diff on noteable that matches our own
  def find_noteable_diff
    diffs = noteable.diffs(Commit.max_diff_options)
    diffs.find { |d| d.new_path == self.diff.new_path }
  end
end
